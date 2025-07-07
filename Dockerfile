FROM ubuntu:20.04

# Add sandbox user
RUN useradd -ms /bin/bash sandbox

# Set working dir temporarily as root
WORKDIR /home/sandbox

# Update + install nano, curl, nodejs
RUN apt update && apt upgrade -y
RUN apt install -y nano curl
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs

# Set colorful prompt for sandbox user
RUN echo "export PS1='\\w\\$ '" >> /home/sandbox/.bashrc
RUN chown -R sandbox:sandbox /home/sandbox

# Set final working dir and switch user
USER sandbox
WORKDIR /home/sandbox/app