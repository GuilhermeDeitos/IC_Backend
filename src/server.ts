import router from "./controllers";
import express from "express";
const app = express();
const PORT = 8000;
app.use(express.json());
app.use(router)

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

