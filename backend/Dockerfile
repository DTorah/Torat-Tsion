FROM node:22-slim
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/src ./src
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm", "start"]
