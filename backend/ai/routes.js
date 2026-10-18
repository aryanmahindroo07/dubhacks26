const {createProviders,AIError}=require('./providers');
const {createAIService}=require('./service');

function registerAIRoutes(app, { service=createAIService({providers:createProviders()}) }={}) {
  const handle=fn=>async(req,res)=>{
    res.set('Cache-Control','no-store');
    try {res.json(await fn(req));}
    catch(error){
      const known=error instanceof AIError;
      res.status(known?error.status:500).json({error:known?error.message:'AI operation failed.',code:known?error.code:'INTERNAL_ERROR'});
    }
  };
  const session=req=>req.get('X-AI-Session');
  app.post('/api/ai/sessions',handle(()=>service.createSession()));
  app.get('/api/ai/session',handle(req=>service.snapshot(session(req))));
  app.delete('/api/ai/session',handle(req=>{service.remove(session(req));return {cleared:true};}));
  app.patch('/api/ai/session',handle(req=>service.setEnabled(session(req),req.body?.enabled)));
  app.post('/api/ai/items',handle(req=>service.upload(session(req),req.body)));
  app.post('/api/ai/items/:id/actions/:action',handle(req=>service.perform(session(req),req.params.id,req.params.action)));
  return service;
}
module.exports={registerAIRoutes};
