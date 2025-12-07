// ⭐ IMPORTANT: REPLACE with your actual Supabase credentials ⭐
// ⭐ IMPORTANT: REPLACE with your actual Supabase credentials ⭐
const SUPABASE_URL = 'https://tvymmublvlvvneclhhdw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2eW1tdWJsdmx2dm5lY2xoaGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjE2OTgsImV4cCI6MjA4MDY5NzY5OH0.7vuXK83tztiORF_51v9n5_pfP97QaivcYwkm6Z-5a_o';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// State to track logged-in user
let staffUserId = null;
let staffEmail = null;

// --- AUTHENTICATION ---
async function staffLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        alert('Login failed: ' + error.message);
    } else {
        staffUserId = data.user.id;
        staffEmail = data.user.email;
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';
        startDashboard();
    }
}

// --- DASHBOARD LOGIC ---
function startDashboard() {
    // 1. Initial Load of all NEW and ASSIGNED service requests
    fetchInitialRequests();
    
    // 2. Initial Load of all active Pool Match requests
    fetchInitialPoolRequests();

    // 3. Real-Time Listener for NEW service requests (INSERT)
    supabase
        .channel('dispatch_service_channel')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'service_requests' 
        }, (payload) => {
            renderServiceRequest(payload.new, 'request-list');
        })
        .on('postgres_changes', { 
            event: 'UPDATE', // To show status changes (e.g., Assigned to Complete)
            schema: 'public', 
            table: 'service_requests' 
        }, (payload) => {
            handleRequestUpdate(payload.new);
        })
        .subscribe();
        
    // 4. Real-Time Listener for NEW pool matches (INSERT and UPDATE)
    supabase
        .channel('dispatch_pool_channel')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'pool_matches',
            filter: `status=eq.Requested` 
        }, (payload) => {
            renderPoolMatch(payload.new);
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public', 
            table: 'pool_matches',
            filter: `status=eq.Accepted`
        }, (payload) => {
             // Remove accepted match from the list
             document.getElementById(`pool-match-${payload.new.id}`).remove();
        })
        .subscribe();
}

// --- FETCH & RENDER FUNCTIONS ---
async function fetchInitialRequests() {
    const { data: requests, error } = await supabase
        .from('service_requests')
        .select('*')
        .in('status', ['New', 'Assigned', 'In Progress']) // Show currently active tasks
        .order('created_at', { ascending: true });

    if (!error) {
        const list = document.getElementById('request-list');
        list.innerHTML = requests.length > 0 ? '' : '<p style="color: var(--color-muted);">No active requests.</p>';
        requests.forEach(req => renderServiceRequest(req, 'request-list'));
    }
}

async function fetchInitialPoolRequests() {
     const { data: pools, error } = await supabase
        .from('pool_matches')
        .select('*')
        .eq('status', 'Requested')
        .order('created_at', { ascending: true });
        
    if (!error) {
        const list = document.getElementById('pool-match-list');
        list.innerHTML = pools.length > 0 ? '' : '<p style="color: var(--color-muted);">No active pool requests.</p>';
        pools.forEach(p => renderPoolMatch(p));
    }
}


function renderServiceRequest(request) {
    const list = document.getElementById('request-list');
    let item = document.getElementById(`request-${request.id}`);

    if (!item) {
        item = document.createElement('div');
        item.id = `request-${request.id}`;
        list.prepend(item); // Prepend new requests to the top
    }
    
    // Determine button state based on status
    let statusText = request.status;
    let actionButtons = '';
    
    if (request.status === 'New') {
        actionButtons = `
            <button class="btn-secondary" onclick="updateRequestStatus(${request.id}, 'Assigned', '${request.table_id}')">Assign</button>
            <button onclick="updateRequestStatus(${request.id}, 'Complete', '${request.table_id}')">Complete</button>
        `;
    } else if (request.status === 'Assigned') {
         statusText = `Assigned to: ${request.assigned_to_email || staffEmail || 'Staff'}`;
         actionButtons = `
            <button onclick="updateRequestStatus(${request.id}, 'Complete', '${request.table_id}')">Complete</button>
        `;
    }
    
    item.innerHTML = `
        <div>
            <strong>Table ${request.table_id}</strong> - ${request.type} (${statusText}) 
            <small style="color: var(--color-muted);">${new Date(request.created_at).toLocaleTimeString()}</small>
        </div>
        <div>
            ${actionButtons}
        </div>
    `;
}

function renderPoolMatch(poolRequest) {
    const list = document.getElementById('pool-match-list');
    let item = document.getElementById(`pool-match-${poolRequest.id}`);

    if (!item) {
        item = document.createElement('div');
        item.id = `pool-match-${poolRequest.id}`;
        list.prepend(item);
    }
    
    item.innerHTML = `
        <div>
            🎱 Player at **Table ${poolRequest.requester_table}** needs a match!
            <small style="color: var(--color-muted);">${new Date(poolRequest.created_at).toLocaleTimeString()}</small>
        </div>
        <div>
            <input type="text" id="challenger-${poolRequest.id}" placeholder="Your Table ID" style="width: 120px; margin-right: 0.5rem;"/>
            <button class="btn-secondary" onclick="acceptPoolMatch(${poolRequest.id}, '${poolRequest.requester_table}')">Accept Match</button>
        </div>
    `;
}

function handleRequestUpdate(updatedRequest) {
    if (updatedRequest.status === 'Complete') {
        // Remove completed task from the dashboard list
        const item = document.getElementById(`request-${updatedRequest.id}`);
        if (item) item.remove();
    } else {
        // Re-render to update status (e.g., New -> Assigned)
        renderServiceRequest(updatedRequest);
    }
}

// --- ACTION HANDLERS ---
async function updateRequestStatus(requestId, newStatus, tableId) {
    if (newStatus === 'Assigned') {
        const eta = prompt('Enter Estimated Time (e.g., 5 mins, ASAP):');
        if (!eta) return; // Cancel if ETA is not provided
         
        const { error } = await supabase
            .from('service_requests')
            .update({ 
                status: newStatus, 
                assigned_to: staffUserId,
                assigned_to_email: staffEmail, // Store email for better tracking
                eta: eta
            })
            .eq('id', requestId);
    } else { // Complete
        const { error } = await supabase
            .from('service_requests')
            .update({ 
                status: newStatus, 
                eta: 'Completed!' // Final message for the client
            })
            .eq('id', requestId);
    }
    
    // RLS in Supabase needs to be configured for this update to work!
}

async function acceptPoolMatch(poolRequestId, requesterTableId) {
    const challengerTableInput = document.getElementById(`challenger-${poolRequestId}`);
    const challengerTableId = challengerTableInput.value.toUpperCase().trim();
    
    if (!challengerTableId || challengerTableId === requesterTableId) {
        alert("Please enter a valid Table ID that is not the requester's.");
        return;
    }

    const { error } = await supabase
        .from('pool_matches')
        .update({
            status: 'Accepted',
            challenger_table: challengerTableId
        })
        .eq('id', poolRequestId);
        
    if (!error) {
        alert(`Match accepted! Player at Table ${requesterTableId} has been notified.`);
    } else {
        alert(`Failed to accept match: ${error.message}`);
    }
}