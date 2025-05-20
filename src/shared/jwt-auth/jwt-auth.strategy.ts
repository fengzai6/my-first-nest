import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';

// @Injectable() // 再看看官方文档。。。
// export class JwtAuthStrategy extends PassportStrategy(Strategy, 'jwt') {}
