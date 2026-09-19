import express, { type Request, type Response, type NextFunction } from 'express';

const errorHandler = (err : Error, req : Request, res : Response, next : NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

module.exports = errorHandler;