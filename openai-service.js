const OpenAI = require('openai');
const { AppError } = require('./errors');

let openaiClient = null;

function initOpenAI(apiKey) {
  if (!apiKey) {
    console.warn('OpenAI API key not provided');
    return;
  }
  openaiClient = new OpenAI({ apiKey });
}

async function parseMovieInput(input) {
  if (!openaiClient) {
    throw new AppError('OpenAI client not initialized', 500);
  }

  const sanitizedInput = (input || '').toString().trim();
  if (!sanitizedInput) {
    throw new AppError('Please enter a movie title to add to your watchlist.', 400);
  }

  const prompt = `Extract movie title and optional year from the user input. If unsure about year or description, return null.
       Reply as strict JSON with keys: title, year, description.

       User input: "${sanitizedInput.replace(/"/g, '\\"')}"`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a movie title parser. Extract movie information from user input and return as JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    if (!parsed.title) {
      throw new AppError('Could not extract a movie title. Try adding more detail or the release year.', 422);
    }

    return {
      title: parsed.title,
      year: parsed.year || null,
      description: parsed.description || null
    };
  } catch (error) {
    console.error('OpenAI parsing error:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('We couldn’t understand that title. Try rephrasing or include the release year.', 422);
  }
}

async function parseMovieFromImage(base64Image) {
  if (!openaiClient) {
    throw new AppError('OpenAI client not initialized', 500);
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a movie identification expert. Analyze images (screenshots, movie posters, social media posts, etc.) to identify movies being discussed or shown.
                    Extract the main movie title from the image. This could be from:
                    - Movie posters or promotional material
                    - Social media posts or tweets about movies
                    - Screenshots from movies
                    - Text mentioning movies
                    - Video frames or scenes
                    Be careful to only extract actual movie titles, not TV shows or other content.
                    Return as strict JSON with keys: title, year, description.
                    If no movie can be identified, return null for title.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'What movie is shown or discussed in this image? Extract the movie title and any additional information you can determine.'
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image,
                detail: 'high'
              }
            }
          ]
        }
      ],
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    if (!parsed.title) {
      throw new AppError('Could not identify a movie from the image. Try a clearer image or enter the title manually.', 422);
    }

    return {
      title: parsed.title,
      year: parsed.year || null,
      description: parsed.description || null
    };
  } catch (error) {
    console.error('OpenAI image parsing error:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('We couldn’t extract a movie from that image. Try another image or type the title instead.', 422);
  }
}

module.exports = {
  initOpenAI,
  parseMovieInput,
  parseMovieFromImage
};
