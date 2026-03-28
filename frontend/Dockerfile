FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

# Standard dev server command for Vite with host binding
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
