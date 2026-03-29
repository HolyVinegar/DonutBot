const express = require('express');
const { exec } = require('child_process');

const app = express();
app.use(express.json());

app.post('/process', (req, res) => {
  const withdrawals = req.body;

  withdrawals.forEach((w, i) => {
    setTimeout(() => {
      const cmd = `/pay ${w.mcUser} ${w.amount}`;
      console.log("💸", cmd);

      exec(`AutoHotkey.exe pay.ahk "${cmd}"`);
    }, i * 4000);
  });

  res.json({ success: true });
});

app.listen(6000, () => {
  console.log("Executor running");
});