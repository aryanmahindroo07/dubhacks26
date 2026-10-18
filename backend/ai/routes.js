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
  app.patch('/api/ai/session',handle(req=>{
    const body=req.body||{};
    if(body.enabled===undefined&&body.readAhead===undefined)throw new AIError('Send enabled and/or readAhead.');
    if(body.enabled!==undefined)service.setEnabled(session(req),body.enabled);
    return body.readAhead!==undefined?service.setReadAhead(session(req),body.readAhead):service.snapshot(session(req));
  }));
  app.post('/api/ai/items',handle(req=>service.upload(session(req),req.body)));
  app.post('/api/ai/items/:id/open',handle(req=>service.open(session(req),req.params.id)));
  app.post('/api/ai/items/:id/text',handle(req=>service.setText(session(req),req.params.id,req.body?.text)));
  app.post('/api/ai/items/:id/actions/:action',handle(req=>service.perform(session(req),req.params.id,req.params.action)));
  return service;
}
module.exports={registerAIRoutes};
