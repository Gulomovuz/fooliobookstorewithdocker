# Use official Node.js lightweight image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests first (optimizes build caching)
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy all project files into the container
COPY . .

# Expose the port your server listens on (defaulting to 3000)
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]