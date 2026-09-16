import { defineConfig, loadEnv } from 'vite';

const normalizeBasePath = (value) => {
  if (!value || value === '/') return '/api';
  return value.startsWith('/') ? value.replace(/\/$/, '') || '/api' : `/${value.replace(/\/$/, '')}`;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = normalizeBasePath(env.API_BASE_URL);
  const mockApiPort = Number(env.MOCK_API_PORT || 3001);
  const port = Number(env.PORT || 5173);

  return {
    envPrefix: ['VITE_', 'API_'],
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      open: true,
      proxy: {
        [apiBaseUrl]: {
          target: `http://127.0.0.1:${mockApiPort}`,
          changeOrigin: true
        }
      }
    }
  };
});
