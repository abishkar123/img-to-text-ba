const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const cors = require('cors')

dotenv.config();


const app = express();
app.use(bodyParser.json());
app.use(cors())


const mongoURI = process.env.MONGO_URI || 'your_mongodb_atlas_connection_string';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.log(err));


const imageSchema = new mongoose.Schema({
  image: String,         
  contentType: String,   
});
const Image = mongoose.model('Image', imageSchema);


const storage = multer.memoryStorage();
const upload = multer({ storage });


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/v1/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const base64Image = req.file.buffer.toString('base64');
    const image = new Image({
      image: base64Image,
      contentType: req.file.mimetype,
    });

    const savedImage = await image.save();
    res.json({ message: 'Image saved successfully!', imageId: savedImage._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/v1/gemini', async (req, res) => {
  try {
    const { message, imageId } = req.body;
    if (!message || !imageId) return res.status(400).json({ error: 'Message and imageId are required' });

    const image = await Image.findById(imageId);
    if (!image) return res.status(404).json({ message: 'Image not found' });

    const fileToGenerativePart = (base64Image, mimeType) => ({
      inlineData: {
        data: base64Image,
        mimeType,
      }
    });

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      temperature: 0.7,
      max_tokens: 150,
      top_p: 0.9,
      frequency_penalty: 0.5,
      presence_penalty: 0.3,
    });

    const result = await model.generateContent([
      message,
      fileToGenerativePart(image.image, image.contentType)
    ]);

    const response = await result.response;
    const text = response.text();
    res.send(text);
  } catch (error) {
    console.error('Error retrieving model:', error);
    res.status(500).json({ error: 'Failed to retrieve model', details: error.message });
  }
});


const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Server running on port ${port}`));
