1) run API
npx -y json-server@0.17.4 --watch db.json --routes routes.json --port 3001

2) run web
ng s

3) run service get resource
cd s3-demo
npx http-server ./docs -p 3000 --cors

4) link web
http://localhost:4200/docx-editor