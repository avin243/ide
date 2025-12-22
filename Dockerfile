FROM node:20-bullseye

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    g++ \
    openjdk-17-jdk \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# 🔍 Confirm tools during build (you WILL see this in Render logs)
RUN java -version && javac -version && python --version

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]