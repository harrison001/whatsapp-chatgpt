FROM node:bullseye-slim

WORKDIR /app/

ENV OPENAI_API_KEY ""
ENV PREFIX_ENABLED ""

COPY . .
RUN npm install
RUN npm install -g pm2
RUN npm install vite-node
RUN npm update whatsapp-web.js
COPY src/Injected.js  /app/node_modules/whatsapp-web.js/src/util/Injected.js
COPY src/Message.js  /app/node_modules/whatsapp-web.js/src/structures/Message.js
RUN apt-get update
RUN apt-get install chromium -y

#CMD ["npm", "run", "start"]
CMD ["pm2-runtime", "start", "npm", "--", "start"]


