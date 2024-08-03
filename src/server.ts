import router from "./controllers";
import express from "express";
const app = express();
app.use(express.json());
app.use(router)
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
