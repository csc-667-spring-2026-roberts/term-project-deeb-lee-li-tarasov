import express, { Request, Response } from "express";

const app = express();

const PORT = Number(process.env.PORT ?? 3005);

app.get("/", (request: Request, response: Response) => {
  response.send("<h1>Express</h1>");
});

app.listen(PORT, () => {
  console.log(`Server running on`);
});
