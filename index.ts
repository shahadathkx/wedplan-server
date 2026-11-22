import express from "express";
import { app } from "./src/app";

const vercelApp = express();
vercelApp.use(app);

module.exports = vercelApp;
