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

const appTimeline = getTimelineDates();

function getTimelineDates() {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    return {
        yesterday: yesterday.toISOString().split('T')[0],
        today: today.toISOString().split('T')[0],
        tomorrow: tomorrow.toISOString().split('T')[0]
    };
}

function fetchMasterDataStore() {
    let storageLogs = localStorage.getItem('hq_attendance_matrix_v3');
    if (!storageLogs) {
        storageLogs = { statusLogs: {}, auditTimeline: [] };
        [appTimeline.yesterday, appTimeline.today, appTimeline.tomorrow].forEach(date => {
            storageLogs.statusLogs[date] = {};
            Object.values(companyRegistry).forEach(emp => {
                storageLogs.statusLogs[date][emp.id] = { status: "absent", timestamp: "No Log" }; 
            });
        });
        localStorage.setItem('hq_attendance_matrix_v3', JSON.stringify(storageLogs));
        return storageLogs;
    }
    return JSON.parse(storageLogs);
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

function verifyAndLogin() {
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
        generateReport();
    } else {
        alert("Invalid OTP Token verification code. Please try again.");
    }
}

function initializeDateEngine() {
    const ribbon = document.getElementById('dateSelectorBar');
    ribbon.innerHTML = `
        <button class="date-btn" id="d-${appTimeline.yesterday}" onclick="jumpToDate('${appTimeline.yesterday}')">Prev Day (${appTimeline.yesterday})</button>
        <button class="date-btn" id="d-${appTimeline.today}" onclick="jumpToDate('${appTimeline.today}')">Today (${appTimeline.today})</button>
        <button class="date-btn" id="d-${appTimeline.tomorrow}" onclick="jumpToDate('${appTimeline.tomorrow}')">Next Day (${appTimeline.tomorrow})</button>
    `;
    jumpToDate(appTimeline.today);
}

function jumpToDate(dateTarget) {
    selectedDateString = dateTarget;
    document.querySelectorAll('.date-btn').forEach(btn => btn.classList.remove('active'));
    if(document.getElementById(`d-${dateTarget}`)) {
        document.getElementById(`d-${dateTarget}`).classList.add('active');
    }
    document.getElementById('targetStatusDate').innerText = dateTarget;
    
    renderDirectorMatrix();
}

function submitStatus(statusLabel) {
    const dataStore = fetchMasterDataStore();
    const currentTimeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second:'2-digit' });

    if(!dataStore.statusLogs[selectedDateString]) {
        dataStore.statusLogs[selectedDateString] = {};
    }

    dataStore.statusLogs[selectedDateString][sessionUser.id] = {
        status: statusLabel,
        timestamp: currentTimeString
    };

    dataStore.auditTimeline.unshift({
        date: selectedDateString,
        user: sessionUser.name,
        userId: sessionUser.id,
        role: sessionUser.role,
        status: statusLabel,
        time: currentTimeString
    });

    localStorage.setItem('hq_attendance_matrix_v3', JSON.stringify(dataStore));
    alert(`Status updated to [${statusLabel.toUpperCase()}] at ${currentTimeString}`);
    
    renderDirectorMatrix();
    generateReport();
}

function renderDirectorMatrix() {
    if (!sessionUser || sessionUser.role !== 'director') return;

    const dataStore = fetchMasterDataStore();
    const targetedDayDataset = dataStore.statusLogs[selectedDateString] || {};
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
    const filteredTimeline = dataStore.auditTimeline.filter(item => item.date === selectedDateString);
    
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

    const dataStore = fetchMasterDataStore();
    const targetPerson = document.getElementById('filterPerson').value;
    const startRange = document.getElementById('filterStartDate').value;
    const endRange = document.getElementById('filterEndDate').value;
    const tableBody = document.getElementById('reportTableContent');
    
    tableBody.innerHTML = "";
    const sortedDates = Object.keys(dataStore.statusLogs).sort((a,b) => new Date(b) - new Date(a));
    let rowsGenerated = 0;

    sortedDates.forEach(dateLoop => {
        if (startRange && dateLoop < startRange) return;
        if (endRange && dateLoop > endRange) return;

        Object.keys(companyRegistry).forEach(empId => {
            if (targetPerson !== "all" && empId !== targetPerson) return;

            const employee = companyRegistry[empId];
            const dayLog = dataStore.statusLogs[dateLoop][empId] || { status: "absent", timestamp: "No Log" };

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