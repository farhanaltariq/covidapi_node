const express = require('express')
const app = express()
const axios = require('axios');
const cron = require('node-cron');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = 3000;

const MongoClient = require('mongodb').MongoClient;
const dbConfig = "mongodb://127.0.0.1/covids";
const url = "https://data.covid19.go.id/public/api/update.json";
const uri = dbConfig;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });



function getData(){
    return axios.get(url)
}

function updateDatabase(data){
    client.connect(err => {
        const collection = client.db("covids").collection("datas");
        collection.insertOne(data, (err, res) => {
            if (err) throw err;
            console.log("Data updated");
        });
    });
    
    // create changelog
    var log = {
        "log": "data updated",
        "updated_at": new Date(),
    };
    client.connect(err => {
        const collection = client.db("covids").collection("changelog");
        collection.insertOne(log);
        
    });
}

function checkForUpdate(){
    getData().then(function(response){
        var data = {
            "hari ini": {
                "jumlah_positif"    : response.data['update'].penambahan['jumlah_positif'],
                "jumlah_meninggal"  : response.data['update'].penambahan['jumlah_meninggal'],
                "jumlah_sembuh"     : response.data['update'].penambahan['jumlah_sembuh'],
                "jumlah_dirawat"    : response.data['update'].penambahan['jumlah_dirawat'],
            },
            "data total":{
                "jumlah_positif"    : response.data['update'].total['jumlah_positif'],
                "jumlah_meninggal"  : response.data['update'].total['jumlah_meninggal'],
                "jumlah_sembuh"     : response.data['update'].total['jumlah_sembuh'],
                "jumlah_dirawat"    : response.data['update'].total['jumlah_dirawat'],
            }
        }
        client.connect(err => {
            const collection = client.db("covids").collection("datas");
            collection.find({},{limit: -1}).sort({$natural: -1}).toArray((err, result) => {
                if (err) throw err;
                if( result[0]['data total']['jumlah_positif'] != data['data total']['jumlah_positif'] ||
                result[0]['data total']['jumlah_meninggal'] != data['data total']['jumlah_meninggal'] ||
                result[0]['data total']['jumlah_sembuh'] != data['data total']['jumlah_sembuh'] ||
                result[0]['data total']['jumlah_dirawat'] != data['data total']['jumlah_dirawat']){
                    updateDatabase(data);
                } else
                console.log("No changes")
                
            });
        });
    })
}

// scheduler
cron.schedule('59 23 * * *',  function() {
    checkForUpdate();
});


app.get('/', (req, res) => {
    // send data from databases
    client.connect(err => {
        const collection = client.db("covids").collection("datas");
        
        collection.find({},{limit: 1}).sort({$natural: -1}).toArray((err, result) => {
            if (err) throw err;
            res.send(result[0]);
            client.close();
        });
    });
})


app.listen(port, () => {
    console.log(`app running at http://localhost:${port}`)
})
