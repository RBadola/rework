function errorHandler(err, req, res, next) {
  if (typeof err === "string") {
    // custom application error
    
    return res.status(400).json({ message: err,type:"App" });
  }
  if (err.name === "ValidationError") {
    // mongoose validation error
    return res.status(400).json({ message: err.message,type:"Mongoose" });
  }

  if (err.name === "UnauthorizedError") {
    // jwt authentication error
    return res.status(401).json({ message: "Invalid Token",type:"JWT" });
  }

  // default to 500 server error
  return res.status(500).json({ message: err.message,type:"Default" });
}

export default  errorHandler;