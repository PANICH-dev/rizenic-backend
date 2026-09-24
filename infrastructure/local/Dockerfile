FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY app.js ./
COPY public ./public
USER node
EXPOSE 3000
CMD ["node", "app.js"]
