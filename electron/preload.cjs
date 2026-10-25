"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("courseDesktop", Object.freeze({
  isElectron: true,
  detectPython: () => ipcRenderer.invoke("python:detect"),
  runPython: (request) => ipcRenderer.invoke("python:run", request)
}));
