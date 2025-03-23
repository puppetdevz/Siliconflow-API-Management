FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]