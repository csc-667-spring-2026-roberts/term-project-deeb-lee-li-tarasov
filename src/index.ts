import express, { Request, Response } from "express";
import path from "path";
import router from "./test.js";
const app = express();

const PORT = process.env.PORT || 3005;
app.use(express.static(path.join(process.cwd(), "public")));
app.use(router);
app.get("/", (_req: Request, res: Response) => {
  res.send("<h1>Header</h1>");
});

app.get("/image/:id", (req: Request, res: Response) => {
  const imageId = req.params.id as string;

  const filePath = path.join(process.cwd(), "public", `${imageId}.jpg`);
  try {
    res.sendFile(filePath);
  } catch {
    res.status(400).send("Image does not exist");
  }
});
app.listen(PORT, () => {
  console.log(`Test hot reload by changing this line`);
});
