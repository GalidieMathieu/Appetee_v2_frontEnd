const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Adjust this path to your actual Angular build output folder
const distPath = path.join(__dirname, 'dist', 'appetee_front', 'browser');

app.use(express.static(distPath));

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});