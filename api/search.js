// 기존 export default 대신 이렇게 변경
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // 임시 응답
  res.json({ 
    success: true, 
    message: 'Search API 준비 중',
    data: [] 
  });
};
