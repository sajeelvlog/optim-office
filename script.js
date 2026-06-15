// Connects to a free real-time cloud data pipeline
// To make this fully operational on your end, create a free database project at supabase.com 
// and update these two parameter string configuration lines below:
const SUPABASE_URL = "https://your-project-id.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key-here";

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const companyRegistry = {
    "9496659950": { id: "sajeel", name: "Sajeel", role: "director" },
    "9846481685": { id: "sbr", name: "SBR", role: "director" },
    "9207857785": { id: "nisar", name: "Nisar", role: "director" },
    "8891555130": { id: "jaseera", name: "Jaseera", role: "administrator" },
    "9745465564": { id: "sujisha", name: "Sujisha", role: "telecaller" },
    "8129193705": { id: "muhsina", name: "Muhsina Jasmin", role: "telecaller" },
    "6235370285": { id: "finan", name: "Finan", role: "digital marketer" },
    "7306065081": { id: "ablaj", name: "Ablaj", role: "mentor" }
};

let sessionUser = null;
let selectedDateString = "";
let systemGeneratedOTP = null;
let globalCloudLogs = { statusLogs: {}, auditTimeline: [] };

const appTimeline = getTimelineDates();

function getTimelineDates() {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    return {
        yesterday: yesterday.toISOString().split('T'),
        today: today.toISOString().split('T'),
        tomorrow: tomorrow.toISOString().split('T')
    };
}

// Automatically synchronizes live matrix arrays across networks
async function fetchMasterDataStore() {
    if (!supabase) {
        // Fallback gracefully if cloud settings aren't live yet
        let local = localStorage.getItem('hq_attendance_matrix_v3');
        globalCloudLogs = local ? JSON.parse(local) : { statusLogs: {}, auditTimeline: [] };
    } else {
        const { data, error } = await supabase.from('attendance_store').select('*').single();
        if (data) {
            globalCloudLogs = data.payload;
        } else {
            // Seed base configuration schema
            globalCloudLogs = { statusLogs: {}, auditTimeline: [] };
            [appTimeline.yesterday, appTimeline.today, appTimeline.tomorrow].forEach(date => {
                globalCloudLogs.statusLogs[date] = {};
                Object.values(companyRegistry).forEach(emp => {
                    globalCloudLogs.statusLogs[date][emp.id] = { status: "absent", timestamp: "No Log" }; 
                });
            });
            await supabase.from('attendance_store').insert([{ id: 1, payload: globalCloudLogs }]);
        }
    }
    // Deep initialize target structural arrays if missing
    if(!globalCloudLogs.statusLogs[selectedDateString]) {
        globalCloudLogs.statusLogs[selectedDateString] = {};
    }
    Object.values(companyRegistry).forEach(emp => {
        if(!globalCloudLogs.statusLogs[selectedDateString][emp.id]) {
            globalCloudLogs.statusLogs[selectedDateString][emp.id] = { status: "absent", timestamp: "No Log" };
        }
    });
}

function listenToLiveCloudChanges() {
    if (!supabase) return;
    
    // Subscribes to database hooks to listen for real-time adjustments anywhere in the field
    supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance_store' }, (payload) => {
        globalCloudLogs = payload.new.payload;
        renderDirectorMatrix();
        generateReport();
    })
    .subscribe();
}

function generateAndRequestOTP() {
    const phone = document.getElementById('phoneInput').value.trim();
    if (companyRegistry[phone]) {
        systemGeneratedOTP = Math.floor(1000 + Math.random() * 9000).toString();
        alert(`[SMS GATEWAY SIMULATION]\nTo: ${companyRegistry[phone].name}\nYour secure single-use HQ entry OTP token code is: ${systemGeneratedOTP}`);
        document.getElementById('phoneStep').classList.add('hidden');
        document.getElementById('otpStep').classList.remove('hidden');
    } else {
        alert("This phone number is not registered in our database.");
    }
}

function resetLoginFields() {
    document.getElementById('phoneStep').classList.remove('hidden');
    document.getElementById('otpStep').classList.add('hidden');
    document.getElementById('otpInput').value = "";
    systemGeneratedOTP = null;
}

async function verifyAndLogin() {
    const enteredOTP = document.getElementById('otpInput').value.trim();
    const phone = document.getElementById('phoneInput').value.trim();

    if (enteredOTP === systemGeneratedOTP && systemGeneratedOTP !== null) {
        sessionUser = companyRegistry[phone];
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appScreen').classList.remove('hidden');
        
        document.getElementById('welcomeUser').innerText = `Hello, ${sessionUser.name}`;
        document.getElementById('userRoleDisplay').innerText = sessionUser.role.toUpperCase();

        if (sessionUser.role === 'director') {
            document.getElementById('directorViewBlock').classList.remove('hidden');
            document.getElementById('directorAnalyticsBlock').classList.remove('hidden');
            document.getElementById('restrictionMessage').classList.add('hidden');
        } else {
            document.getElementById('directorViewBlock').classList.add('hidden');
            document.getElementById('directorAnalyticsBlock').classList.add('hidden');
            document.getElementById('restrictionMessage').classList.remove('hidden');
        }

        initializeDateEngine();
        listenToLiveCloudChanges();
    } else {
        alert("Invalid OTP Token verification code. Please try again.");
    }
}

async function initializeDateEngine() {
    const ribbon = document.getElementById('dateSelectorBar');
    ribbon.innerHTML = `
        <button class="date-btn" id="d-${appTimeline.yesterday}" onclick="jumpToDate('${appTimeline.yesterday}')">Prev Day (${appTimeline.yesterday})</button>
        <button class="date-btn" id="d-${appTimeline.today}" onclick="jumpToDate('${appTimeline.today}')">Today (${appTimeline.today})</button>
        <button class="date-btn" id="d-${appTimeline.tomorrow}" onclick="jumpToDate('${appTimeline.tomorrow}')">Next Day (${appTimeline.tomorrow})</button>
    `;
    await jumpToDate(appTimeline.today);
}

async function jumpToDate(dateTarget) {
    selectedDateString = dateTarget;
    document.querySelectorAll('.date-btn').forEach(btn => btn.classList.remove('active'));
    if(document.getElementById(`d-${dateTarget}`)) {
        document.getElementById(`d-${dateTarget}`).classList.add('active');
    }
    document.getElementById('targetStatusDate').innerText = dateTarget;
    
    await fetchMasterDataStore();
    renderDirectorMatrix();
    generateReport();
}

async function submitStatus(statusLabel) {
    await fetchMasterDataStore();
    const currentTimeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second:'2-digit' });

    globalCloudLogs.statusLogs[selectedDateString][sessionUser.id] = {
        status: statusLabel,
        timestamp: currentTimeString
    };

    globalCloudLogs.auditTimeline.unshift({
        date: selectedDateString,
        user: sessionUser.name,
        userId: sessionUser.id,
        role: sessionUser.role,
        status: statusLabel,
        time: currentTimeString
    });

    if (supabase) {
        await supabase.from('attendance_store').update({ payload: globalCloudLogs }).eq('id', 1);
    } else {
        localStorage.setItem('hq_attendance_matrix_v3', JSON.stringify(globalCloudLogs));
    }

    alert(`Status updated to [${statusLabel.toUpperCase()}] at ${currentTimeString}`);
    renderDirectorMatrix();
    generateReport();
}

function renderDirectorMatrix() {
    if (!sessionUser || sessionUser.role !== 'director') return;

    const targetedDayDataset = globalCloudLogs.statusLogs[selectedDateString] || {};
    const floorGrid = document.getElementById('officeFloorGrid');
    floorGrid.innerHTML = "";

    Object.values(companyRegistry).forEach(employee => {
        const currentRecord = targetedDayDataset[employee.id] || { status: "absent", timestamp: "No Log" };
        
        const cardUIStructure = `
            <div class="desk s-${currentRecord.status}">
                <div class="status-light"></div>
                <div style="font-size: 22px; margin-bottom:4px;">👤</div>
                <div style="font-weight: bold; font-size:14px;">${employee.name}</div>
                <div class="role-tag">${employee.role}</div>
                <div class="desk-time">Time: ${currentRecord.timestamp}</div>
            </div>
        `;
        floorGrid.innerHTML += cardUIStructure;
    });

    const timelineBox = document.getElementById('liveTimelineBox');
    timelineBox.innerHTML = "";
    const filteredTimeline = globalCloudLogs.auditTimeline.filter(item => item.date === selectedDateString);
    
    if(filteredTimeline.length === 0) {
        timelineBox.innerHTML = "<li style='color:#6b7280; justify-content:center;'>No structural transactions completed today.</li>";
    } else {
        filteredTimeline.forEach(item => {
            timelineBox.innerHTML += `<li><span>🔔 <strong>${item.user}</strong> changed state to <span style="color:#60a5fa">${item.status.toUpperCase()}</span></span> <span style="color:#9ca3af">${item.time}</span></li>`;
        });
    }
}

function handleMonthFilterChange() {
    const selectedMonth = document.getElementById('filterMonth').value;
    if (selectedMonth !== "all") {
        document.getElementById('filterStartDate').value = `${selectedMonth}-01`;
        document.getElementById('filterEndDate').value = `${selectedMonth}-31`; 
    } else {
        document.getElementById('filterStartDate').value = "";
        document.getElementById('filterEndDate').value = "";
    }
    generateReport();
}

function clearMonthDropdown() {
    document.getElementById('filterMonth').value = "all";
}

function generateReport() {
    if (!sessionUser || sessionUser.role !== 'director') return;

    const targetPerson = document.getElementById('filterPerson').value;
    const startRange = document.getElementById('filterStartDate').value;
    const endRange = document.getElementById('filterEndDate').value;
    const tableBody = document.getElementById('reportTableContent');
    
    tableBody.innerHTML = "";
    const sortedDates = Object.keys(globalCloudLogs.statusLogs).sort((a,b) => new Date(b) - new Date(a));
    let rowsGenerated = 0;

    sortedDates.forEach(dateLoop => {
        if (startRange && dateLoop < startRange) return;
        if (endRange && dateLoop > endRange) return;

        Object.keys(companyRegistry).forEach(empId => {
            if (targetPerson !== "all" && empId !== targetPerson) return;

            const employee = companyRegistry[empId];
            const dayLog = globalCloudLogs.statusLogs[dateLoop][empId] || { status: "absent", timestamp: "No Log" };

            const recordRow = `
                <tr>
                    <td><strong>${dateLoop}</strong></td>
                    <td>${employee.name}</td>
                    <td><span style="font-size:11px; font-weight:bold; color:#93c5fd;">${employee.role.toUpperCase()}</span></td>
                    <td><span style="color:${getStatusColorVariable(dayLog.status)} font-weight:bold;">● ${dayLog.status.toUpperCase()}</span></td>
                    <td>${dayLog.timestamp}</td>
                </tr>
            `;
            tableBody.innerHTML += recordRow;
            rowsGenerated++;
        });
    });

    if (rowsGenerated === 0) {
        tableBody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:#6b7280;'>No logged attendance metrics match the specific filters.</td></tr>";
    }
}

function getStatusColorVariable(status) {
    if(status === 'present') return '#2ecc71;';
    if(status === 'break') return '#ffffff;';
    if(status === 'left') return '#f1c40f;';
    return '#e74c3c;';
}

function handleLogout() {
    sessionUser = null;
    resetLoginFields();
    document.getElementById('phoneInput').value = "";
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
}