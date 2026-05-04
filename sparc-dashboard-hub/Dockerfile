# Use Node.js 20
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including Vite)
RUN npm install

# Copy code
COPY . .

# Open both ports
EXPOSE 7000
EXPOSE 7001

# Run both the UI and the Server together!
CMD ["sh", "-c", "npm run dev -- --host & npm run server"]
