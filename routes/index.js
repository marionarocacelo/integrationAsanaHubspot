var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


router.get('/asana-test', async (req, res, next) => {
  console.log('ASANA_PAT present?', !!process.env.ASANA_PAT);
  return res.status(200).json({ "message": "hi!", "token": process.env.ASANA_TOKEN });
  try {
    const response = await fetch('https://app.asana.com/api/1.0/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.ASANA_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        'Asana error:',
        response.status,
        JSON.stringify(data)
      );
      return res.status(500).json({
        status: response.status,
        data,
      });
    }

    return res.json(data);
  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).json({
      error: 'Fetch error',
      message: err.message,
    });
  }
});


module.exports = router;
