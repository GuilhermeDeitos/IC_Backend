//Interface com os dados customizados do usuário, como a data de início e fim da consulta, a estação
export interface CustomDataEntity {
    dataInicio: string; //Só é necessário se o usuário desejar consultar um intervalo de tempo
    dataFinal: string; 
    codigoEstacao: string; //Codigo da estação que o usuário deseja consultar
    frequencia: Frequencia; //Frequencia dos dados que o usuário deseja consultar
    hora?: string; //Esse parametro só é necessário se o usuário desejar os dados horários de todas as estações automaticas de um determinado dia
}

//namespace com 4 opcoes de string: hora, diario, semanal, mensal
export type Frequencia = "hora" | "diario" | "semanal" | "mensal"
