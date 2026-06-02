// REZ Staff Scheduling Service

const express = require('express');
const app = express();

app.use(express.json());

const staff = new Map();
const shifts = new Map();
const schedules = new Map();

// Add staff
app.post('/api/staff', (req, res) => {
  const { merchantId, name, email, phone, role, hourlyRate } = req.body;
  const staffId = 'STF' + Date.now();

  const member = {
    staffId,
    merchantId,
    name,
    email,
    phone,
    role,
    hourlyRate,
    status: 'active',
    createdAt: new Date()
  };

  staff.set(staffId, member);

  res.json({ success: true, staffId });
});

// Get staff
app.get('/api/staff/:merchantId', (req, res) => {
  const { merchantId } = req.params;
  const list = [];

  staff.forEach(s => {
    if (s.merchantId === merchantId) {
      list.push(s);
    }
  });

  res.json({ staff: list });
});

// Create shift
app.post('/api/shifts', (req, res) => {
  const { staffId, date, startTime, endTime, role } = req.body;
  const shiftId = 'SFT' + Date.now();

  const shift = {
    shiftId,
    staffId,
    date,
    startTime,
    endTime,
    role,
    status: 'scheduled',
    createdAt: new Date()
  };

  shifts.set(shiftId, shift);

  res.json({ success: true, shiftId });
});

// Get shifts
app.get('/api/shifts', (req, res) => {
  const { staffId, merchantId, date } = req.query;
  const list = [];

  shifts.forEach(s => {
    if ((!staffId || s.staffId === staffId) && (!date || s.date === date)) {
      list.push(s);
    }
  });

  res.json({ shifts: list });
});

// Update shift
app.put('/api/shifts/:shiftId', (req, res) => {
  const shift = shifts.get(req.params.shiftId);
  if (shift) {
    Object.assign(shift, req.body);
  }
  res.json({ success: true });
});

// Clock in
app.post('/api/shifts/:shiftId/clock-in', (req, res) => {
  const shift = shifts.get(req.params.shiftId);
  if (shift) {
    shift.clockedIn = new Date();
    shift.status = 'in_progress';
  }
  res.json({ success: true });
});

// Clock out
app.post('/api/shifts/:shiftId/clock-out', (req, res) => {
  const shift = shifts.get(req.params.shiftId);
  if (shift) {
    shift.clockedOut = new Date();
    shift.status = 'completed';
  }
  res.json({ success: true });
});

// Get schedule
app.get('/api/schedule/:merchantId', (req, res) => {
  const { merchantId } = req.params;
  const { startDate, endDate } = req.query;

  const list = [];
  shifts.forEach(s => {
    const member = staff.get(s.staffId);
    if (member && member.merchantId === merchantId) {
      list.push({ ...s, staff: member });
    }
  });

  res.json({ schedule: list });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'staff-scheduling' }));

const PORT = process.env.PORT || 4025;
app.listen(PORT, () => console.log(`Staff Scheduling on ${PORT}`));

module.exports = app;
