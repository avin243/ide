FROM node:20-bullseye

# Install Python3, compilers and JDK (needed if you want to run Python/C++/Java code from the IDE)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 python3-pip g++ default-jdk \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
