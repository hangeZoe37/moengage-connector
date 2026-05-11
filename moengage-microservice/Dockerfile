# Use Node.js 20 as the base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Install nodemon globally so it works even with volume mounts
RUN npm install -g nodemon

# Copy package files first (better for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port from your .env (4000)
EXPOSE 4000

# Start the application
CMD ["nodemon", "server.js"]
