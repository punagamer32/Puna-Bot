# Use an official Node.js runtime as a base
FROM node:18

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your bot code
COPY . .

# Expose no ports (Discord bots don’t need incoming HTTP)
# EXPOSE 3000  <-- only if you add a web dashboard

# Start the bot
CMD ["npm", "start"]
