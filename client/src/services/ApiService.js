import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.token = null;
  }

  async login(username, password) {
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, {
        user: username,
        pass: password
      });
      
      if (response.data.success) {
        this.token = response.data.token;
        return { success: true, token: this.token };
      }
      return { success: false, error: response.data.error };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  }

  async call(method, params = []) {
    if (!this.token && method !== 'auth.login') {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/rpc`, {
        method,
        params,
        token: this.token
      });
      
      return response.data;
    } catch (error) {
      console.error('RPC call error:', error);
      throw error.response?.data || error.message;
    }
  }

  // Helper methods for common operations
  async getVersion() {
    return this.call('core.version');
  }

  async listModules() {
    return this.call('module.exploits');
  }

  async listSessions() {
    return this.call('session.list');
  }

  // Add more helper methods as needed...
}

export default new ApiService();