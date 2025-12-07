// ⭐ IMPORTANT: REPLACE with your actual Supabase credentials ⭐
// ⭐ IMPORTANT: REPLACE with your actual Supabase credentials ⭐
const SUPABASE_URL = 'https://tvymmublvlvvneclhhdw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2eW1tdWJsdmx2dm5lY2xoaGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjE2OTgsImV4cCI6MjA4MDY5NzY5OH0.7vuXK83tztiORF_51v9n5_pfP97QaivcYwkm6Z-5a_o';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state for the menu and current order
let menuData = [];
let currentOrder = {}; // Stores item_id: quantity
const TAX_RATE = 0.05; // 5% tax

// 1. Get Table ID from URL and Initialize
const urlParams = new URLSearchParams(window.location.search);
const tableId = urlParams.get('table') || 'A1'; // Default to A1 if no param found
document.title = `Club Service - Table ${tableId}`;

// 2. Load Menu Items (GET request)
async function loadMenu() {
    const { data: menu, error } = await supabase
        .from('menu_items')
        .select('id, name, price, category');
    
    if (error) {
        document.getElementById('modal-menu-items').innerHTML = `<p style="color: var(--color-danger);">Error loading menu: ${error.message}</p>`;
        return;
    }

    // --- PLACEHOLDER DATA: If DB is empty, use mock data ---
    if (!menu || menu.length === 0) {
        menuData = [
            { id: 1, name: 'Gin & Tonic', price: 12.00, category: 'Drinks' },
            { id: 2, name: 'Mojito (Classic)', price: 14.50, category: 'Drinks' },
            { id: 3, name: 'Local Lager', price: 7.00, category: 'Drinks' },
            { id: 4, name: 'Sliders (Beef)', price: 18.00, category: 'Food' },
            { id: 5, name: 'Loaded Fries', price: 10.00, category: 'Food' },
            { id: 6, name: 'Nachos Supreme', price: 22.00, category: 'Food' },
        ];
    } else {
        menuData = menu;
    }
    
    renderMenuModal();
    startRealtimeListener();
}

// 3. Render Menu Items into the Modal
function renderMenuModal() {
    const modalContent = document.getElementById('modal-menu-items');
    modalContent.innerHTML = '';

    const categories = [...new Set(menuData.map(item => item.category))];
    
    categories.forEach(category => {
        const catHeader = document.createElement('h3');
        catHeader.textContent = category;
        catHeader.style.marginTop = '1.5rem';
        catHeader.style.color = 'var(--color-text)';
        modalContent.appendChild(catHeader);

        menuData.filter(item => item.category === category).forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'menu-item';
            
            const itemPrice = item.price.toFixed(2);
            const itemId = item.id;
            const currentQty = currentOrder[itemId] || 0;

            itemDiv.innerHTML = `
                <div>
                    <strong>${item.name}</strong><br>
                    <small style="color: var(--color-muted);">$${itemPrice}</small>
                </div>
                <div class="quantity-control">
                    <button onclick="updateQuantity(${itemId}, -1)">-</button>
                    <span id="qty-${itemId}">${currentQty}</span>
                    <button onclick="updateQuantity(${itemId}, 1)">+</button>
                </div>
            `;
            modalContent.appendChild(itemDiv);
        });
    });
    calculateTotal();
}

// 4. Quantity and Total Calculation Logic
function updateQuantity(itemId, change) {
    let currentQty = currentOrder[itemId] || 0;
    let newQty = currentQty + change;

    if (newQty < 0) newQty = 0;

    if (newQty === 0) {
        delete currentOrder[itemId];
    } else {
        currentOrder[itemId] = newQty;
    }

    // Update the visible quantity on the modal
    const qtySpan = document.getElementById(`qty-${itemId}`);
    if (qtySpan) {
        qtySpan.textContent = newQty;
    }
    calculateTotal();
}

function calculateTotal() {
    let subtotal = 0;
    
    // Convert currentOrder (ID: Qty) into a list of items with price
    const orderItems = Object.keys(currentOrder).map(id => {
        const item = menuData.find(i => i.id == id);
        if (item) {
            subtotal += item.price * currentOrder[id];
            return {
                name: item.name,
                qty: currentOrder[id],
                price: item.price
            };
        }
        return null;
    }).filter(i => i !== null);

    const tax = subtotal * TAX_RATE;
    const finalTotal = subtotal + tax;

    document.getElementById('order-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('order-total').textContent = `$${finalTotal.toFixed(2)}`;
    document.getElementById('final-total').textContent = `$${finalTotal.toFixed(2)}`;

    // Enable/disable the place order button
    const orderBtn = document.getElementById('place-order-btn');
    if (subtotal > 0) {
        orderBtn.disabled = false;
        orderBtn.classList.remove('btn-muted');
    } else {
        orderBtn.disabled = true;
        orderBtn.classList.add('btn-muted');
    }

    return orderItems; // Return the formatted list for placing the order
}

// 5. Menu Modal Controls
function openMenuModal() {
    document.getElementById('menu-modal').style.display = 'block';
    renderMenuModal(); // Ensure latest quantities/totals are shown
}

function closeMenuModal() {
    document.getElementById('menu-modal').style.display = 'none';
}

// 6. Place Order Function (POST request)
async function placeOrder() {
    const items = calculateTotal();
    if (items.length === 0) return;

    // Optional: Add tax and total to the payload if needed
    const orderPayload = {
        table_id: tableId,
        type: 'Order',
        status: 'New',
        items: items, // JSON list of {name, qty, price}
        total: parseFloat(document.getElementById('order-total').textContent.replace('$', ''))
    };

    const { data, error } = await supabase
        .from('service_requests')
        .insert([orderPayload])
        .select();
    
    if (!error) {
        alert('Order placed successfully! Tracking started.');
        // Reset local state
        currentOrder = {};
        closeMenuModal();
        
        // Update status for the user
        document.getElementById('current-order-status').textContent = `Order placed! Total: $${orderPayload.total.toFixed(2)}`;
        document.getElementById('current-status').textContent = `Status: New (Food/Drink Order)`;
        document.getElementById('current-eta').textContent = `Estimated Time: Waiting for staff assignment.`;
    } else {
        alert(`Order failed: ${error.message}`);
    }
}

// --- REST OF CLIENT.JS (Unchanged Functions) ---

// 7. Request Standard Service (Bartender, Security, etc.) (POST request)
async function requestService(type) {
    const { data, error } = await supabase
        .from('service_requests')
        .insert([{
            table_id: tableId,
            type: type,
            status: 'New',
            items: null // Only orders have items
        }])
        .select();
    
    if (!error) {
        alert(`${type} requested successfully! Status tracking started.`);
        document.getElementById('current-status').textContent = `Status: New (${type} Request)`;
        document.getElementById('current-eta').textContent = `Estimated Time: Waiting for staff assignment.`;
    } else {
        alert(`Request failed: ${error.message}`);
    }
}

// 8. Request Pool Match (POST request)
async function requestPoolMatch() {
    const { data, error } = await supabase
        .from('pool_matches')
        .insert([{
            requester_table: tableId,
            status: 'Requested'
        }])
        .select();

    if (!error) {
        document.getElementById('match-status').innerHTML = `<p style="color: var(--color-secondary);">Pool match request sent! Waiting for a player...</p>`;
    } else {
         document.getElementById('match-status').innerHTML = `<p style="color: var(--color-danger);">Request failed: ${error.message}</p>`;
    }
}

// 9. Real-Time Status Tracking (Listen for staff updates on this table)
function startRealtimeListener() {
    supabase
        .channel('request_changes')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'service_requests',
            filter: `table_id=eq.${tableId}` 
        }, (payload) => {
            console.log('Real-time update received:', payload);
            const { status, eta } = payload.new;
            if (status) {
                document.getElementById('current-status').textContent = `Status: ${status} (${payload.new.type})`;
                document.getElementById('current-eta').textContent = `Estimated Time: ${eta || 'A moment'}`;
            }
        })
        .on('postgres_changes', {
             event: 'UPDATE', 
             schema: 'public', 
             table: 'pool_matches',
             filter: `challenger_table=eq.${tableId}` 
        }, (payload) => {
             if (payload.new.status === 'Accepted' && payload.new.requester_table !== tableId) {
                document.getElementById('match-status').innerHTML = `<p class="btn-secondary" style="margin-top:1rem; padding: 0.5rem;">Match accepted by **Table ${payload.new.requester_table}**! Head to the pool table.</p>`;
             }
        })
        .subscribe();
}

// Initialize on load
loadMenu();
// Realtime listener is now started inside loadMenu()
