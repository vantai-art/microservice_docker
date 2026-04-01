FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY src/ ./src/
RUN mkdir -p src/logs
VOLUME ["/app/src/logs"]
EXPOSE 8006
CMD ["node", "src/server.js"]
