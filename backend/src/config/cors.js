export function createCorsOptions(frontendUrl) {
  const allowed = new Set([
    new URL(frontendUrl).origin,
    'https://www.carteliax.com',
    'https://carteliax.com',
  ]);
  return {
    origin(origin, callback) {
      // Requests without Origin (SSR/webhooks/CLI) do not require browser CORS.
      callback(null, !origin || allowed.has(origin));
    },
  };
}
