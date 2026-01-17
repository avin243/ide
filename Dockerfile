FROM node:20-bullseye

# Set up environment variables for Go, Java, and the consolidated PATH
ENV GO_VERSION=1.21.0
ENV GO_ARCH=amd64
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
# Consolidate PATH for all language tools to ensure they are available globally
ENV PATH="/usr/local/go/bin:/root/.cargo/bin:/root/.dotnet/tools:${JAVA_HOME}/bin:${PATH}"

# Install base dependencies, Python, C++, Java, Ruby, and required tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    g++ \
    openjdk-17-jdk \
    ruby \
    wget \
    curl \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Install Go
RUN wget https://golang.org/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz -O /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz

# Install .NET SDK and the csharp-script workload
RUN wget https://packages.microsoft.com/config/debian/11/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
RUN dpkg -i packages-microsoft-prod.deb
RUN rm packages-microsoft-prod.deb
RUN apt-get update && \
    apt-get install -y dotnet-sdk-7.0 && \
    rm -rf /var/lib/apt/lists/*
RUN dotnet workload install csharp-script

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Verify that all compilers and runtimes are correctly installed and in the PATH
RUN java -version && javac -version && python --version && g++ --version && dotnet --version && ruby --version && go version && rustc --version

# Set up the Node.js application environment
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
