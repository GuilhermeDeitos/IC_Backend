import { CustomDataEntity } from "../entities/customDataEntity";
import { DataAPIEntity } from "../entities/dataAPIEntity";
import dotenv from "dotenv";
dotenv.config();

interface Data {
  dataInicio: string;
  dataFinal: string;
}

export class Api {
  private url: string;
  private frequencia: string;
  private data: Data;
  private codigoEstacao: string;
  constructor(params: CustomDataEntity) {
    this.data = {
      dataInicio: params.dataInicio,
      dataFinal: params.dataFinal,
    };
    this.codigoEstacao = params.codigoEstacao;
    this.frequencia = params.frequencia;
    this.url = `http://apitempo.inmet.gov.br/token/estacao/${params.dataInicio}/${params.dataFinal}/${params.codigoEstacao}/${process.env.TOKEN_API}`;
  }

  private atualizarValoresMaxMin( //Faz a atribuição a partir do parametro "minOrMax", caso min, salva o menor valor, caso max, salva o maior valor
    valorAtual: DataAPIEntity,
    chave: keyof DataAPIEntity,
    valorAnterior: DataAPIEntity,
    minOrMax: "min" | "max"
  ) {
    const atual = Number(valorAtual[chave]);
    const anterior = Number(valorAnterior[chave]);
  
    if (valorAtual[chave] !== null && 
        ((minOrMax === "min" && atual < anterior) || 
         (minOrMax === "max" && atual > anterior))) {
      valorAnterior[chave] = valorAtual[chave] as any;
    }
  }
  

  // Função auxiliar para calcular a média e converter para string
  private calcularMedia(
    objeto: DataAPIEntity,
    chave: keyof DataAPIEntity,
    objSoma: Record<string, number>,
    divisor: number
  ) {
    objeto[chave] = (Number(objSoma[chave] as any) / divisor).toFixed(2); // toFixed(2) para limitar a duas casas decimais
  }

  //Função auxiliar para fazer a requisição da API, converter para JSON e retirar os campos que não são necessários
  private async fetchApi(): Promise<DataAPIEntity[]> {
    return await fetch(this.url)
      .then((response) => response.json())
      .then((data) => {
        return data.map((dado: DataAPIEntity) => {
          //Retirar os campos desnecessários "TEM_CPU", "TEM_SEN", "TEN_BAT", "VEN_RAJ", "VEN_DIR"
          ["TEM_CPU", "TEM_SEN", "TEN_BAT", "VEN_RAJ", "VEN_DIR"].forEach(
            (key: string) => {
              delete dado[key as keyof DataAPIEntity];
            }
          );

          return dado;
        });
      });
  }
  //Função auxiliar para acumular os dados caso a diferença de datas maior que 1 ano e 1 dia
  private async acumularDados(
    dataInicioOriginal: Date,
    dataFinalOriginal: Date
  ) {
    //Dividir as datas para fazer requisições separadas
    const datas: Data[] = [];
    const dataInicio = new Date(dataInicioOriginal.getTime());

    while (dataInicio.getTime() < dataFinalOriginal.getTime()) { 
      const dataFinal =
        new Date(dataInicio.getTime() + 31536000000) > dataFinalOriginal
          ? dataFinalOriginal 
          : new Date(dataInicio.getTime() + 31536000000); //Esse valor é o valor para 1 ano e 1 dia 
      datas.push({
        dataInicio: dataInicio.toISOString().split("T")[0],
        dataFinal: dataFinal.toISOString().split("T")[0],
      });
      dataInicio.setTime(dataFinal.getTime());
    }

    const response = await Promise.all( //Faz as requisições para todas as datas
      datas.map(async (data) => {
        const url = `http://apitempo.inmet.gov.br/token/estacao/${data.dataInicio}/${data.dataFinal}/${this.codigoEstacao}/${process.env.TOKEN_API}`;
        const response = await fetch(url);
        return await response.json();
      })
    );


    //Juntar os arrays de dados
    const dadosAcumulados = response.reduce((acc, cur) => {
      return acc.concat(cur);
    }, []);

    return dadosAcumulados;
  }

  private tratarInstantaneos(response: any): DataAPIEntity[] {
    return this.separarDias(this.frequencia, response) //Organiza os dados da resposta (1 obj para cada hora) em dias/semana/mes (varia da frequencia), retornando um vetor de vetores em q cada item é um vetor que concatena 24 itens (24 horas)
      .map((dia: DataAPIEntity[]) => this.processarDia(dia)) //Percorre vetor por vetor para fazermos os tratamentos
      .reduce((acc, cur) => acc.concat(cur), []); //Juntamos tudo novamente
  }

  private processarDia(dia: DataAPIEntity[]): DataAPIEntity[] {
    const acumulado = this.inicializarAcumulado(dia[0]); //Apenas para termos valores para comparar em alguns tratamentos
    const somas = this.inicializarSomas(); //Campos que somam dados
    let contadorRadGlo = 0; //contador de valores de radiação positiva para divisão posterior
    let ultimoDia = ""; 

    dia.forEach((medicao:DataAPIEntity, index:number) => { //Percorrendo cada dia (24 vetores, 1 para cada hora)
      if (index === dia.length - 1) {
        ultimoDia = medicao["DT_MEDICAO"]; //Apenas para concatenar no DT_MEDIÇÂO no fim
      }

      this.atualizaValoresMaxMin(medicao, acumulado); //Método auxiliar para atualizar valores maximos e minimos
      this.somarValores(medicao, somas); //Metodo auxiliar para soma

      if (medicao["RAD_GLO"] !== null && Number(medicao["RAD_GLO"]) > 0) { //Tratamento da radiação
        somas["RAD_GLO"] += Number(medicao["RAD_GLO"]);
        contadorRadGlo++;
      }
    });

    this.calcularMedias(acumulado, somas, dia.length, contadorRadGlo); //Metodo auxiliar que retorna as médias dos valores instantaneos

    acumulado["CHUVA"] = somas["CHUVA"].toFixed(2); 
    acumulado["TEM_MED"] = (
      (Number(acumulado["TEM_MAX"]) + Number(acumulado["TEM_MIN"])) /
      2
    ).toFixed(2);
    acumulado["num_dias"] = dia.length / 24;
    acumulado["DT_MEDICAO"] += ` ${ultimoDia}`;

    delete acumulado["HR_MEDICAO"];

    return [acumulado];
  }

  private inicializarAcumulado(primeiroRegistro: DataAPIEntity): DataAPIEntity { //Apenas retorna um objeto inicializado
    return { ...primeiroRegistro };
  }

  private inicializarSomas(): Record<string, number> { //Retorna um objeto com os campos que serão somados
    return {
      PTO_INS: 0,
      UMD_INS: 0,
      TEM_INS: 0,
      PRE_INS: 0,
      RAD_GLO: 0,
      CHUVA: 0,
      VEN_VEL: 0,
    };
  }

  private atualizaValoresMaxMin( 
    medicao: DataAPIEntity,
    acumulado: DataAPIEntity
  ) { //Separa quais campos calcularão o maximo e minimo, e com isso chama a função de atualização
    const camposMaxMin: Record<string, "min" | "max"> = {
      PRE_MAX: "max",
      PRE_MIN: "min",
      TEM_MAX: "max",
      TEM_MIN: "min",
      UMD_MAX: "max",
      UMD_MIN: "min",
      PTO_MAX: "max",
      PTO_MIN: "min",
    };

    Object.keys(camposMaxMin).forEach((chave) => {
      this.atualizarValoresMaxMin(
        medicao,
        chave as keyof DataAPIEntity,
        acumulado,
        camposMaxMin[chave]
      );
    });
  }

  private somarValores(medicao: DataAPIEntity, somas: Record<string, number>) { //Apenas soma os valores necessários
    somas["PTO_INS"] += Number(medicao["PTO_INS"]);
    somas["UMD_INS"] += Number(medicao["UMD_INS"]);
    somas["TEM_INS"] += Number(medicao["TEM_INS"]);
    somas["PRE_INS"] += Number(medicao["PRE_INS"]);
    somas["VEN_VEL"] += Number(medicao["VEN_VEL"]);
    somas["CHUVA"] += Number(medicao["CHUVA"]);
  }

  private calcularMedias(
    acumulado: DataAPIEntity,
    somas: Record<string, number>,
    totalDias: number,
    contadorRadGlo: number
  ) { //Método auxiliar para indicar o calculo da média dos valores necessários 
    this.calcularMedia(acumulado, "PTO_INS", somas, totalDias);
    this.calcularMedia(acumulado, "UMD_INS", somas, totalDias);
    this.calcularMedia(acumulado, "TEM_INS", somas, totalDias);
    this.calcularMedia(acumulado, "PRE_INS", somas, totalDias);
    this.calcularMedia(acumulado, "RAD_GLO", somas, contadorRadGlo);
    this.calcularMedia(acumulado, "VEN_VEL", somas, totalDias);
  }

  private separarDias(frequencia: string, response: DataAPIEntity[]): DataAPIEntity[][] {
    const dias: DataAPIEntity[][] = [];
    const modDias = 24; // Juntar os dados de 24 em 24 horas para formar um dia

    // Agrupar os dados por dia
    response.forEach((medicao, index) => {
        if (index % modDias === 0) {
            dias.push([medicao]);
        } else {
            dias[dias.length - 1].push(medicao);
        }
    });

    // Função auxiliar para agrupar os dias em semanas ou meses
    const agruparPeriodos = (intervalo: number): DataAPIEntity[][] => {
        const periodos: DataAPIEntity[][] = [];
        for (let i = 0; i < dias.length; i += intervalo) {
            periodos.push(dias.slice(i, i + intervalo).flat());
        }
        return periodos;
    };

    // Agrupar conforme a frequência
    switch (frequencia) {
        case "semanal":
            return agruparPeriodos(7);
        case "mensal":
            return agruparPeriodos(30);
        default:
            return dias;
    }
}


  async get() {
    try {
      // Primeiro calcular a diferença nas datas
      const dataInicioOriginal = new Date(this.data.dataInicio);
      const dataFinalOriginal = new Date(this.data.dataFinal);
      const diferenca = Math.ceil(
        Math.abs(dataFinalOriginal.getTime() - dataInicioOriginal.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const response =
        diferenca > 366
          ? await this.acumularDados(dataInicioOriginal, dataFinalOriginal)
          : await this.fetchApi();

      return this.frequencia === "horario"
        ? response
        : this.tratarInstantaneos(response);
    } catch (err) {
      return err;
    }
  }
}
