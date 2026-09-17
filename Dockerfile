FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix ./backend && npm cache clean --force

COPY backend ./backend
COPY frontend ./frontend

RUN mkdir -p /app/backend/data /app/backend/uploads \
  && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["node", "backend/server.js"]