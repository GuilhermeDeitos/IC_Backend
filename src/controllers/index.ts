import express from "express";
import { DataAPIEntity } from "../entities/dataAPIEntity";
import { Api } from "./dataController";

const router = express.Router();

router.post("/api/interval/", async (req, res) => {
  const { dataInicio, dataFinal, codigoEstacao, frequencia } = req.body;
  const dadosApi: { data: DataAPIEntity[] } = { data: [] }; //Inicializando a variavel data vazia
  try {
    const data = new Api({ dataInicio, dataFinal, codigoEstacao, frequencia });
    dadosApi.data = await data.get();
    if (dadosApi.data.length > 0) {
      res.status(200).json(dadosApi);
    } else {
      res.status(404).json({ data:dadosApi.data, message: "Dados não encontrados" });
    }
  } catch (err) {
  
    res.status(500).json({ message: "Erro de servidor", erro: err});
  }
});

export default router;
