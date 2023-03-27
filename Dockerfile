FROM node:bullseye-slim

RUN apt update
# components for whatsapp-web.js (support no-gui systems)
#RUN apt install -y gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 l
RUN apt install -y chromium

# For transcription
# RUN apt install -y ffmpeg
## It will install latest model of OpenAI Whisper (around 6~7 GB)
## Uncomment below command if you want to use the local version of transcription module
# RUN pip install -y python pip
# RUN pip install -U openai-whisper



WORKDIR /app/

ENV OPENAI_API_KEY ""
ENV PREFIX_ENABLED ""

COPY . .
COPY package.json package-lock.json ./
RUN npm install
RUN npm install -g pm2
RUN npm install vite-node
RUN npm update whatsapp-web.js
COPY src/Injected.js  /app/node_modules/whatsapp-web.js/src/util/Injected.js
COPY src/Message.js  /app/node_modules/whatsapp-web.js/src/structures/Message.js

#CMD ["npm", "run", "start"]
CMD ["pm2-runtime", "start", "npm", "--", "start"]


