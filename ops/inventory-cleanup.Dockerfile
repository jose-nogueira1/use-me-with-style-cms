FROM node:24-alpine
WORKDIR /app
COPY release-expired-reservations.mjs .
USER node
CMD ["node", "/app/release-expired-reservations.mjs", "--inventory-only"]
