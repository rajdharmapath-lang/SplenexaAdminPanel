import { build, preview } from 'vite';

async function start() {
  await build();
  const server = await preview({
    preview: {
      host: '0.0.0.0',
      port: Number(process.env.PORT) || 4173,
      strictPort: true,
    },
  });
  server.printUrls();
}

start().catch((error) => {
  console.error('Unable to start the admin panel:', error);
  process.exitCode = 1;
});
