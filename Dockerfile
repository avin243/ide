FROM node:20-bullseye

# Install Python, C++ compiler, and Java
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 python3-pip g++ openjdk-17-jdk \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify installations at build time
RUN node -v && python --version && javac -version

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
