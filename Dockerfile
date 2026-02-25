FROM node:20-alpine

WORKDIR /app

# Copy root package
COPY package.json ./

# Copy server
COPY server/package.json ./server/
RUN cd server && npm install --production

# Copy client
COPY client/package.json ./client/
RUN cd client && npm install

# Copy all source files
COPY server/ ./server/
COPY client/ ./client/

# Build client
RUN cd client && npm run build

# Create upload directories
RUN mkdir -p server/uploads/images server/uploads/videos server/uploads/audio \
    server/uploads/voice server/uploads/documents server/uploads/profiles server/uploads/status

# Expose port
EXPOSE 5000

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Start server
CMD ["node", "server/server.js"]
