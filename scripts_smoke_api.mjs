process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('./apps/api/src/server.mjs');

server.listen(3100, async () => {
  const res = await fetch('http://127.0.0.1:3100/health');
  const text = await res.text();
  console.log(text);
  server.close();
});
