export const config = {
  isDevelopment: true,
  get minSessions() {
    return this.isDevelopment ? 5 : 30;
  },
  port: 3000,
  dbFile: './server/data/sessions.json',
};
