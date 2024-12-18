FROM node:18-alpine

# Install required Linux packages (including OpenSSL)
RUN apk add --no-cache openssl ghostscript graphicsmagick

# Set the working directory to /app
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Remove CLI packages since we don't need them in production by default.
# Remove this line if you want to run CLI commands in your container.
RUN npm remove @shopify/cli

# Copy the rest of your application code
COPY . .

# Build the application
RUN npm run build

# Expose the port the app will run on
EXPOSE 3000

# Start the app using the Docker entrypoint
CMD ["npm", "run", "docker-start"]
